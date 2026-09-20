# Evalon. Go toolchain lives outside PATH on the development machine; see
# docs/project/PROGRESS.md for how it was installed.
GO ?= go
BIN := bin/evalon

# Test SSH lab. See test/lab.sh.
.PHONY: check test build lab lab-down lab-status lab-ra2 lab-ra2-down clean

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
	test/ra2.sh

## build: single binary in bin/evalon.
build:
	$(GO) build -o $(BIN) ./cmd/evalon

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

clean:
	rm -rf bin/
