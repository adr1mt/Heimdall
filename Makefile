# Evalon. Go toolchain lives outside PATH on the development machine; see
# docs/project/PROGRESS.md for how it was installed.
GO ?= go
BIN := bin/evalon

# Test SSH lab. 127.1.2.3 on purpose: Teuton routes any address containing
# "127.0.0." to local execution (F-01) and A-11 checks that we do not.
LAB_IMAGE := teutonlab-ssh
LAB_HOST  := 127.1.2.3

.PHONY: check test build lab lab-down clean

## check: fast suite. No network, no disk. Must stay under 10 s.
check:
	$(GO) vet ./...
	$(GO) test ./...

## test: check plus the SSH integration suite. Needs `make lab`.
test: check
	$(GO) test -tags=integration ./...

## build: single binary in bin/evalon.
build:
	$(GO) build -o $(BIN) ./cmd/evalon

## lab: bring up the podman SSH lab used by the integration tests.
lab:
	podman build -t $(LAB_IMAGE) -f docs/research/evidence/Containerfile docs/research/evidence
	podman run -d --replace --name alu1 -p $(LAB_HOST):2201:22 $(LAB_IMAGE)
	podman run -d --replace --name alu2 -p $(LAB_HOST):2202:22 $(LAB_IMAGE)

## lab-down: stop and remove the lab containers.
lab-down:
	-podman rm -f alu1 alu2

clean:
	rm -rf bin/
