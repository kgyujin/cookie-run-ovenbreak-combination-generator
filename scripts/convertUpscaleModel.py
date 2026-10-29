"""
관리 페이지 'AI로 2배 키우기'에 쓰는 가중치 파일을 만든다 (한 번만 돌리면 되는 도구).

원본: Real-ESRGAN RealESRGAN_x4plus_anime_6B.pth (BSD-3-Clause, https://github.com/xinntao/Real-ESRGAN)
  https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth
  sha256 f872d837d3c90ed2e05227bed711af5671a6fd1c9f7d7e91c911a61f155e99da

결과: public/models/realesrgan-x4-anime-6b.bin
  텐서를 원본 순서대로 이어 붙인 float16 (리틀 엔디언). 합성곱 가중치는 TensorFlow.js 모양 [높이, 너비, 입력, 출력]으로 바꿔 둔다.
  읽는 쪽: lib/studio/upscale.ts

torch 없이 numpy만으로 읽는다. pickle에서 텐서 복원에 필요한 것 말고는 불러오지 않는다.
사용: python3 -I scripts/convertUpscaleModel.py RealESRGAN_x4plus_anime_6B.pth public/models/realesrgan-x4-anime-6b.bin
"""
import collections
import hashlib
import pickle
import sys
import zipfile

import numpy as np

SHA256 = 'f872d837d3c90ed2e05227bed711af5671a6fd1c9f7d7e91c911a61f155e99da'
STORAGE_TYPES = {'FloatStorage': np.float32, 'HalfStorage': np.float16}


def load_state_dict(path):
    archive = zipfile.ZipFile(path)
    prefix = archive.namelist()[0].split('/')[0]

    def rebuild_tensor(storage, offset, size, stride, *_):
        key, dtype = storage
        data = np.frombuffer(archive.read(f'{prefix}/data/{key}'), dtype=dtype)
        count = int(np.prod(size)) if size else 1
        contiguous = tuple(int(np.prod(size[i + 1:])) for i in range(len(size)))
        if tuple(stride) != contiguous:
            raise ValueError(f'연속되지 않은 텐서는 지원하지 않음: {size} {stride}')
        return data[offset:offset + count].reshape(size)

    class SafeUnpickler(pickle.Unpickler):
        def find_class(self, module, name):
            if (module, name) == ('torch._utils', '_rebuild_tensor_v2'):
                return rebuild_tensor
            if module == 'torch' and name in STORAGE_TYPES:
                return name
            if (module, name) == ('collections', 'OrderedDict'):
                return collections.OrderedDict
            raise pickle.UnpicklingError(f'허용하지 않는 객체: {module}.{name}')

        def persistent_load(self, pid):
            _, storage_type, key, _location, _numel = pid
            return key, STORAGE_TYPES[storage_type]

    state = SafeUnpickler(archive.open(f'{prefix}/data.pkl')).load()
    return state['params_ema']


def main(src, dest):
    with open(src, 'rb') as f:
        digest = hashlib.sha256(f.read()).hexdigest()
    if digest != SHA256:
        sys.exit(f'원본 파일이 다릅니다 (sha256 {digest})')
    chunks = []
    for name, tensor in load_state_dict(src).items():
        if tensor.ndim == 4:
            tensor = tensor.transpose(2, 3, 1, 0)  # [출력, 입력, 높이, 너비] → [높이, 너비, 입력, 출력]
        chunks.append(np.ascontiguousarray(tensor, dtype='<f2').tobytes())
    with open(dest, 'wb') as f:
        f.write(b''.join(chunks))
    print(f'{dest}: 텐서 {len(chunks)}개, {sum(map(len, chunks))} 바이트')


if __name__ == '__main__':
    main(*sys.argv[1:3])
