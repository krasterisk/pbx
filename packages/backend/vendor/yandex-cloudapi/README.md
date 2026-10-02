# Yandex Cloud SpeechKit protocol assets

Minimal transitive `.proto` closure for the STT v3 and TTS v3 services used by
`voice-robots/providers`. Copied from `yandex-cloud/cloudapi` commit
`9a0259083cfe80eb57cde12b3fae764a74f7c983` (MIT license). The Google API
and RPC imports come from that repository's `third_party/googleapis` directory
(Apache 2.0 license). `google/protobuf/*` well-known types are supplied by
`@grpc/proto-loader`.

Trailing whitespace in comments is normalized for the repository's diff checks.

`database/copy-build-assets.cjs` copies this directory into `dist` so the
runtime gRPC providers can resolve it without a build-time network clone.
