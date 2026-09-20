# Heimdall. Go toolchain lives outside PATH on the development machine; see
# docs/project/PROGRESS.md for how it was installed.
GO ?= go
BIN := bin/heimdall

# Test SSH lab. See test/lab.sh.
.PHONY: check test build lab lab-down lab-status lab-ra2 lab-ra2-down rendimiento gui-check gui-build gui-lab clean

## check: fast suite. No network, no disk. Must stay under 10 s.
check:
	$(GO) vet ./...
	$(GO) test ./...

## test: check plus the SSH integration suite and the acceptance scripts.
## Needs `make lab` and `make lab-ra2`.
test: check build
	$(GO) test -tags=integration ./...
	test/secrets.sh
	test/acceptance.sh
	test/eventos.sh
	test/ra2.sh
	test/carga.sh

## rendimiento: measure scaling instead of guessing it (ADR-0013). Needs make lab.
## Not part of make test: it is slow and it must not fail for being slow.
rendimiento: build
	test/rendimiento.sh

## build: single binary in bin/heimdall.
build:
	$(GO) build -o $(BIN) ./cmd/heimdall

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

## gui-lab: correct a lab exam through the built application and check that no
## password leaks out of memory. Needs `make build`, `make gui-build` and
## `make lab`.
gui-lab:
	cd gui && ./scripts/secretos.sh

clean:
	rm -rf bin/
