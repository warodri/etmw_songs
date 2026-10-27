import argparse
import os
import subprocess

import torch

from heartlib import HeartMuLaGenPipeline


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_path", default="./ckpt")
    parser.add_argument("--version", default="3B")
    parser.add_argument("--lyrics", default="./heartlib/assets/lyrics.txt")
    parser.add_argument("--tags", default="./heartlib/assets/tags.txt")
    parser.add_argument("--save_path", default="./output.mp3")
    parser.add_argument("--max_audio_length_ms", type=int, default=30_000)
    parser.add_argument("--topk", type=int, default=50)
    parser.add_argument("--temperature", type=float, default=1.0)
    parser.add_argument("--cfg_scale", type=float, default=3.0)
    parser.add_argument("--seed", type=int, default=None)
    args = parser.parse_args()

    if args.seed is not None:
        torch.manual_seed(args.seed)

    if torch.backends.mps.is_available():
        device = torch.device("mps")
        mula_dtype = torch.float16
    else:
        device = torch.device("cpu")
        mula_dtype = torch.bfloat16

    pipe = HeartMuLaGenPipeline.from_pretrained(
        args.model_path,
        device={"mula": device, "codec": device},
        dtype={"mula": mula_dtype, "codec": torch.float32},
        version=args.version,
        lazy_load=False,
    )

    os.makedirs(os.path.dirname(os.path.abspath(args.save_path)), exist_ok=True)
    pipe_save_path = args.save_path
    tmp_wav = None
    if args.save_path.lower().endswith(".mp3"):
        tmp_wav = f"{args.save_path}.tmp.wav"
        pipe_save_path = tmp_wav

    with torch.no_grad():
        pipe(
            {"lyrics": args.lyrics, "tags": args.tags},
            max_audio_length_ms=args.max_audio_length_ms,
            save_path=pipe_save_path,
            topk=args.topk,
            temperature=args.temperature,
            cfg_scale=args.cfg_scale,
        )

    if tmp_wav is not None:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", tmp_wav, args.save_path],
            check=True,
        )
        os.remove(tmp_wav)

    print(f"Generated music saved to {args.save_path}")


if __name__ == "__main__":
    main()
