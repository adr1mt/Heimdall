# Heimdall. See docs/DESARROLLO.md for toolchain prerequisites and GO override.
GO ?= go
PYTHON ?= python3
.DEFAULT_GOAL := check
BIN := bin/heimdall

# One version for the whole product: the engine is stamped with it at build
# time and the application reads it from its package.json. test/version.sh
# checks the two have not drifted apart.
VERSION := $(shell cat VERSION)

# Test SSH lab. See test/lab.sh.
.PHONY: docs-check tools-check check test build version lab lab-down lab-status lab-ra2 lab-ra2-down rendimiento gui-check gui-build gui-dist gui-paquete gui-lab gui-editor clean

## docs-check: maintained local documentation links, without network access.
docs-check:
	$(PYTHON) scripts/check_doc_links.py

## tools-check: navigation command and link-checker regressions.
tools-check:
	$(PYTHON) -B -m unittest discover -s test/tools -p 'test_*.py'

## check: fast suite. No network, no disk. Must stay under 10 s.
check:
	$(GO) vet ./...
	$(GO) test ./...

## test: check plus the SSH integration suite and the acceptance scripts.
## Needs `make lab` and `make lab-ra2`.
test: check build
	$(GO) test -tags=integration ./...
	test/version.sh
	test/secrets.sh
	test/acceptance.sh
	test/eventos.sh
	$(PYTHON) test/progress_pipe.py
	test/sesion.sh
	test/ra2.sh
	test/carga.sh

## rendimiento: measure scaling instead of guessing it (ADR-0013). Needs make lab.
## Not part of make test: it is slow and it must not fail for being slow.
rendimiento: build
	test/rendimiento.sh

## build: single binary in bin/heimdall, stamped with VERSION.
build:
	$(GO) build -ldflags "-X main.version=$(VERSION)" -o $(BIN) ./cmd/heimdall

## version: what engine and application say they are.
version: build
	test/version.sh

## lab: bring up the podman SSH lab used by the integration tests.
lab:
	test/lab.sh up

## lab-ra2: bring up the two RA2 student machines (KEA + BIND).
lab-ra2:
	test/ra2/lab.sh up

## lab-ra2-down: stop and remove them.
lab-ra2-down:
	test/ra2/lab.sh down

## lab-down: stop and remove the lab container.
lab-down:
	test/lab.sh down

## lab-status: report whether the lab is listening.
lab-status:
	test/lab.sh status

## gui-check: the GUI's own fast suite. Independent Node tree, so `make check`
## never depends on it.
gui-check:
	cd gui && npm run typecheck && npm test

## gui-build: compile the GUI into gui/out.
gui-build:
	cd gui && npm run build

## gui-dist: AppImage and .deb in gui/dist, with the engine inside. The
## teacher installs that and needs nothing else (T072).
gui-dist: build
	cd gui && npm run dist

## gui-paquete: check the built package works on a machine with nothing
## installed (T072). Needs `make gui-dist` and `make lab`.
gui-paquete:
	cd gui && ./scripts/paquete.sh

## gui-lab: correct a lab exam through the built application and check that no
## password leaks out of memory. Needs `make build`, `make gui-build` and
## `make lab`.
gui-lab:
	cd gui && ./scripts/secretos.sh

## gui-editor: write an exam from the application's editor and correct the lab
## with it (T109). Needs `make build`, `make gui-build` and `make lab`.
gui-editor:
	cd gui && HEIMDALL_ENGINE=$(PWD)/bin/heimdall LAB_SECRET=HEIMDALL_SECRET_TEST_12345 npm run --silent editor-lab

clean:
	rm -rf bin/
