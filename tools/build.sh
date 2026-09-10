#!/bin/bash
set -eu
cd "$(dirname "$0")/.."
"${ZIG_BINARY:-tools/zig-x86_64-linux-0.14.1/zig}" c++ -target wasm32-wasi -mexec-model=reactor -O2 -fno-exceptions -fno-rtti -fwrapv -DTEST -Ivendor/eurorack src/braids-wrapper.cc vendor/eurorack/braids/analog_oscillator.cc vendor/eurorack/braids/digital_oscillator.cc vendor/eurorack/braids/macro_oscillator.cc vendor/eurorack/braids/resources.cc vendor/eurorack/stmlib/utils/random.cc -Wl,--export=init -Wl,--export=render -Wl,--export-memory -o public/braids.wasm
