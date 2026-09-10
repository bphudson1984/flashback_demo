# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS build
ARG BUILDARCH
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl xz-utils && rm -rf /var/lib/apt/lists/*
RUN set -eux; case "$BUILDARCH" in \
    amd64) arch=x86_64; checksum=24aeeec8af16c381934a6cd7d95c807a8cb2cf7df9fa40d359aa884195c4716c ;; \
    arm64) arch=aarch64; checksum=f7a654acc967864f7a050ddacfaa778c7504a0eca8d2b678839c21eea47c992b ;; \
    *) exit 1 ;; esac; \
    curl -fsSL --retry 3 "https://ziglang.org/download/0.14.1/zig-${arch}-linux-0.14.1.tar.xz" -o /tmp/zig.tar.xz; \
    echo "$checksum  /tmp/zig.tar.xz" | sha256sum -c -; \
    mkdir /opt/zig; tar -xJf /tmp/zig.tar.xz -C /opt/zig --strip-components=1; rm /tmp/zig.tar.xz
WORKDIR /app
RUN mkdir -p vendor/eurorack/stmlib && \
    curl -fsSL --retry 3 https://codeload.github.com/pichenettes/eurorack/tar.gz/08460a69a7e1f7a81c5a2abcc7189c9a6b7208d4 -o /tmp/eurorack.tar.gz && \
    tar -xzf /tmp/eurorack.tar.gz -C vendor/eurorack --strip-components=1 && \
    curl -fsSL --retry 3 https://codeload.github.com/pichenettes/stmlib/tar.gz/d18def816c51d1da0c108236928b2bbd25c17481 -o /tmp/stmlib.tar.gz && \
    tar -xzf /tmp/stmlib.tar.gz -C vendor/eurorack/stmlib --strip-components=1 && rm /tmp/*.tar.gz
COPY src/ src/
COPY tools/build.sh tools/test.mjs tools/render.mjs tools/
COPY public/ public/
ENV ZIG_BINARY=/opt/zig/zig
RUN bash tools/build.sh && node tools/test.mjs && node tools/render.mjs

FROM nginx:1.31-alpine@sha256:72ba65eb42c10344912a84ff42408db7d34f2feb642204570ab8fc5ffd29f1d3
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/public/ /usr/share/nginx/html/
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
