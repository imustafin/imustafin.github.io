FROM ruby:3.4.1-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      git build-essential libvips \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1000 appgroup && \
    useradd appuser --uid 1000 --gid appgroup --shell /bin/bash

RUN mkdir -p /bundle
WORKDIR /app
RUN chown appuser:appgroup /app
RUN chown appuser:appgroup /bundle

RUN bundle config set --local path /bundle

USER appuser
