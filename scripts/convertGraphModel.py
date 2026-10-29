"""
관리 페이지 이미지 다듬기에 쓰는 AI 모델 파일을 만든다 (한 번만 돌리면 되는 도구).

1) waifu2x CUNet (MIT, https://github.com/nagadomi/waifu2x, ncnn 변환본 https://github.com/nihui/waifu2x-ncnn-vulkan models/models-cunet)
   python3 -I scripts/convertGraphModel.py ncnn noise0_scale2.0x_model.param noise0_scale2.0x_model.bin public/models/waifu2x-cunet-2x-noise0.bin
   (noise1~3도 같은 방식, 노이즈 제거 없는 scale2.0x_model은 public/models/waifu2x-cunet-2x.bin)
2) 애니 캐릭터 인식 isnet-anime (Apache-2.0, https://github.com/SkyTNT/anime-segmentation, ONNX 변환본 https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-anime.onnx)
   python3 scripts/convertGraphModel.py onnx isnet-anime.onnx public/models/isnet-anime.bin
   (onnx 패키지가 필요: pip install onnx. 원본 sha256 f15622d853e8260172812b657053460e20806f04b9e05147d49af7bed31a6e99)

결과 파일: 'GRPH' + 머리말 길이(uint32) + 머리말(JSON) + 가중치. 읽는 쪽: lib/studio/graphModel.ts
  머리말: { nodes: [...], tensors: [{ shape, dtype: 'f16' | 'i8', offset, scale? }] }
  합성곱 가중치는 TensorFlow.js 모양 [높이, 너비, 입력, 출력] (전치 합성곱은 [높이, 너비, 출력, 입력]).
  i8은 출력 채널마다 따로 맞춘 8비트 (scale: float32 배열의 위치), 용량을 1/4로 줄인다.
"""
import json
import struct
import sys

import numpy as np


class Writer:
    def __init__(self):
        self.tensors = []
        self.chunks = []
        self.size = 0

    def _put(self, raw):
        offset = self.size
        self.chunks.append(raw)
        self.size += len(raw)
        pad = (-self.size) % 4
        if pad:
            self.chunks.append(b'\0' * pad)
            self.size += pad
        return offset

    def add(self, array, quantize=False):
        array = np.ascontiguousarray(array, dtype=np.float32)
        if quantize and array.ndim == 4:
            # 출력 채널(마지막 축)마다 가장 큰 절댓값을 127에 맞춘다
            peak = np.abs(array).reshape(-1, array.shape[-1]).max(axis=0)
            scale = np.where(peak > 0, peak / 127, 1).astype(np.float32)
            q = np.clip(np.round(array / scale), -127, 127).astype(np.int8)
            entry = {'shape': list(array.shape), 'dtype': 'i8', 'offset': self._put(q.tobytes()), 'scale': self._put(scale.tobytes())}
        else:
            entry = {'shape': list(array.shape), 'dtype': 'f16', 'offset': self._put(array.astype('<f2').tobytes())}
        self.tensors.append(entry)
        return len(self.tensors) - 1

    def save(self, path, nodes):
        header = json.dumps({'nodes': nodes, 'tensors': self.tensors}, separators=(',', ':')).encode()
        header += b' ' * ((-len(header)) % 4)
        with open(path, 'wb') as f:
            f.write(b'GRPH' + struct.pack('<I', len(header)) + header)
            for c in self.chunks:
                f.write(c)


# ---------- ncnn (waifu2x) ----------

def read_ncnn(param_path, bin_path):
    lines = open(param_path).read().split('\n')
    assert lines[0].strip() == '7767517'
    layers = []
    for line in lines[2:]:
        if not line.strip():
            continue
        parts = line.split()
        kind, name, n_in, n_out = parts[0], parts[1], int(parts[2]), int(parts[3])
        ins = parts[4:4 + n_in]
        outs = parts[4 + n_in:4 + n_in + n_out]
        params = {}
        for p in parts[4 + n_in + n_out:]:
            k, v = p.split('=')
            params[int(k)] = v
        layers.append((kind, name, ins, outs, params))
    data = open(bin_path, 'rb').read()
    pos = 0

    def weight(count):
        nonlocal pos
        flag = struct.unpack_from('<I', data, pos)[0]
        pos += 4
        if flag == 0x01306B47:  # float16
            w = np.frombuffer(data, '<f2', count, pos).astype(np.float32)
            pos += (count * 2 + 3) // 4 * 4
        elif flag == 0:
            w = np.frombuffer(data, '<f4', count, pos).copy()
            pos += count * 4
        else:
            raise ValueError(f'지원하지 않는 가중치 형식 {flag:#x}')
        return w

    def bias(count):
        nonlocal pos
        b = np.frombuffer(data, '<f4', count, pos).copy()
        pos += count * 4
        return b

    out = []
    for kind, name, ins, outs, params in layers:
        w = b = None
        # 가중치 수와 치우침 여부: 합성곱은 6번, 5번 / InnerProduct는 2번, 1번 값
        size_key, bias_key = (2, 1) if kind == 'InnerProduct' else (6, 5)
        if kind in ('Convolution', 'Deconvolution', 'InnerProduct'):
            w = weight(int(params[size_key]))
            if params.get(bias_key) == '1':
                b = bias(int(params[0]))
        out.append((kind, name, ins, outs, params, w, b))
    assert pos == len(data), f'가중치를 다 읽지 못함 {pos} / {len(data)}'
    return out


ACTS = {None: None, '1': 'relu', '2': 'lrelu', '4': 'sigmoid'}


def convert_ncnn(param_path, bin_path, out_path):
    layers = read_ncnn(param_path, bin_path)
    wr = Writer()
    nodes = []
    alias = {}  # Split 출력 → 원래 이름
    name = lambda n: alias.get(n, n)
    input_name = None
    for kind, _, ins, outs, p, w, b in layers:
        ins = [name(i) for i in ins]
        if kind == 'Input':
            input_name = outs[0]
        elif kind == 'Split':
            for o in outs:
                alias[o] = ins[0]
        elif kind in ('Convolution', 'Deconvolution'):
            out_c, k = int(p[0]), int(p[1])
            stride = int(p.get(3, 1))
            pad = int(p.get(4, 0))
            act = ACTS[p.get(9)]
            if act == 'lrelu':
                assert abs(float(p[-23310].split(',')[1]) - 0.1) < 1e-6
            in_c = w.size // (out_c * k * k)
            if kind == 'Convolution':
                # ncnn [출력, 입력, 높이, 너비] → [높이, 너비, 입력, 출력]
                wt = w.reshape(out_c, in_c, k, k).transpose(2, 3, 1, 0)
            else:
                # ncnn 전치 합성곱도 [출력, 입력, 높이, 너비]로 저장되어 있다 → [높이, 너비, 출력, 입력]
                wt = w.reshape(out_c, in_c, k, k).transpose(2, 3, 0, 1)
            nodes.append({'op': 'conv' if kind == 'Convolution' else 'deconv', 'in': ins, 'out': outs[0], 'w': wr.add(wt), 'b': wr.add(b), 'stride': stride, 'pad': pad, 'act': act})
        elif kind == 'Pooling':
            assert p.get(0) == '1' and p.get(4) == '1'  # 전체 평균
            nodes.append({'op': 'mean', 'in': ins, 'out': outs[0]})
        elif kind == 'InnerProduct':
            out_c = int(p[0])
            in_c = w.size // out_c
            wt = w.reshape(out_c, in_c).T.reshape(1, 1, in_c, out_c)
            nodes.append({'op': 'conv', 'in': ins, 'out': outs[0], 'w': wr.add(wt), 'b': wr.add(b), 'stride': 1, 'pad': 0, 'act': ACTS[p.get(9)]})
        elif kind == 'Scale':
            nodes.append({'op': 'mul', 'in': ins, 'out': outs[0]})
        elif kind == 'Crop':
            nodes.append({'op': 'crop', 'in': ins, 'out': outs[0], 'offset': int(p[0])})
            assert p[0] == p[1]
        elif kind == 'Eltwise':
            assert p.get(0) == '1'  # 더하기
            nodes.append({'op': 'add', 'in': ins, 'out': outs[0]})
        else:
            raise ValueError(f'지원하지 않는 층 {kind}')
    nodes.insert(0, {'op': 'input', 'out': input_name})
    nodes.append({'op': 'output', 'in': [nodes[-1]['out']]})
    wr.save(out_path, nodes)
    return nodes, wr


# ---------- ONNX (isnet-anime) ----------

def convert_onnx(onnx_path, out_path):
    import onnx
    from onnx import numpy_helper

    model = onnx.load(onnx_path)
    g = model.graph
    inits = {i.name: numpy_helper.to_array(i) for i in g.initializer}
    size = g.input[0].type.tensor_type.shape.dim[2].dim_value  # 원본이 맞춰진 입력 크기
    attrs = lambda n: {a.name: onnx.helper.get_attribute_value(a) for a in n.attribute}
    consumers = {}
    for n in g.node:
        for i in n.input:
            consumers.setdefault(i, []).append(n)
    wr = Writer()
    nodes = [{'op': 'input', 'out': g.input[0].name}]
    fused = set()
    for n in g.node:
        a = attrs(n)
        if n.op_type == 'Conv':
            assert a['group'] == 1 and len(set(a['pads'])) == 1 and a['strides'][0] == a['strides'][1] and a['dilations'][0] == a['dilations'][1]
            w = inits[n.input[1]].transpose(2, 3, 1, 0)  # [출력, 입력, 높이, 너비] → [높이, 너비, 입력, 출력]
            b = inits[n.input[2]]
            out = n.output[0]
            act = None
            nxt = consumers.get(out, [])
            if len(nxt) == 1 and nxt[0].op_type in ('Relu', 'Sigmoid'):
                act = nxt[0].op_type.lower()
                fused.add(nxt[0].name)
                out = nxt[0].output[0]
            nodes.append({'op': 'conv', 'in': [n.input[0]], 'out': out, 'w': wr.add(w, quantize=True), 'b': wr.add(b), 'stride': a['strides'][0], 'pad': a['pads'][0], 'dil': a['dilations'][0], 'act': act})
        elif n.op_type in ('Relu', 'Sigmoid'):
            if n.name not in fused:
                nodes.append({'op': n.op_type.lower(), 'in': [n.input[0]], 'out': n.output[0]})
        elif n.op_type == 'MaxPool':
            assert a['kernel_shape'] == [2, 2] and a['strides'] == [2, 2] and not any(a.get('pads', [0]))
            nodes.append({'op': 'maxpool', 'in': [n.input[0]], 'out': n.output[0]})
        elif n.op_type == 'Resize':
            assert a['mode'] == b'linear' and a['coordinate_transformation_mode'] == b'pytorch_half_pixel'
            sizes = inits[n.input[3]]
            assert sizes[2] == sizes[3]
            # 입력 크기에 대한 비율로 저장 (64의 배수 크기면 어느 크기에서나 정확)
            nodes.append({'op': 'resize', 'in': [n.input[0]], 'out': n.output[0], 'ratio': int(sizes[2]) / size})
        elif n.op_type == 'Concat':
            assert a['axis'] == 1
            nodes.append({'op': 'concat', 'in': list(n.input), 'out': n.output[0]})
        elif n.op_type == 'Add':
            nodes.append({'op': 'add', 'in': list(n.input), 'out': n.output[0]})
        else:
            raise ValueError(f'지원하지 않는 연산 {n.op_type}')
    nodes.append({'op': 'output', 'in': [g.output[0].name]})
    wr.save(out_path, nodes)
    return nodes, wr


if __name__ == '__main__':
    kind = sys.argv[1]
    if kind == 'ncnn':
        convert_ncnn(sys.argv[2], sys.argv[3], sys.argv[4])
    elif kind == 'onnx':
        convert_onnx(sys.argv[2], sys.argv[3])
    else:
        raise SystemExit('사용: convertGraphModel.py ncnn PARAM BIN OUT | onnx ONNX OUT')
    print('저장:', sys.argv[-1])
