//go:build integration

package ssh

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"fmt"
	xssh "golang.org/x/crypto/ssh"
	"heimdall/internal/model"
	"net"
	"testing"
	"time"
)

func unresponsiveSession(t *testing.T, mode string) *Session {
	t.Helper()
	_, key, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	signer, err := xssh.NewSignerFromKey(key)
	if err != nil {
		t.Fatal(err)
	}
	cfg := &xssh.ServerConfig{NoClientAuth: true}
	cfg.AddHostKey(signer)
	listener, err := net.Listen("tcp", "127.1.2.3:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { listener.Close() })
	go func() {
		raw, err := listener.Accept()
		if err != nil {
			return
		}
		server, channels, requests, err := xssh.NewServerConn(raw, cfg)
		if err != nil {
			return
		}
		defer server.Close()
		go xssh.DiscardRequests(requests)
		for incoming := range channels {
			if mode == "open" {
				continue
			}
			channel, reqs, err := incoming.Accept()
			if err != nil {
				return
			}
			go func() {
				for req := range reqs {
					if mode == "start" {
						continue
					}
					req.Reply(true, nil)
					code := uint32(137)
					if mode == "no-marker" || mode == "wrong-marker" {
						code = 0
					}
					if mode == "wrong-marker" {
						channel.Stderr().Write([]byte("\x1eHEIMDALL_expected:1\x1f"))
					}
					channel.SendRequest("exit-status", false, xssh.Marshal(struct{ Status uint32 }{code}))
					channel.Close()
				}
			}()
		}
	}()
	client, err := xssh.Dial("tcp", listener.Addr().String(), &xssh.ClientConfig{User: "audit", HostKeyCallback: xssh.InsecureIgnoreHostKey(), Timeout: time.Second})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { client.Close() })
	return &Session{client: client, cfg: Config{Host: "audit"}}
}

func TestUnconfirmedCompletionHasNoExitCode(t *testing.T) {
	for _, mode := range []string{"no-marker", "wrong-marker"} {
		s := unresponsiveSession(t, mode)
		res := s.exec(context.Background(), []string{"true"}, time.Second, "\x1eHEIMDALL_expected:")
		if res.Completed || res.ExitCode != nil || res.RemoteProcess != model.RemoteUnknown {
			t.Fatalf("%s: %+v", mode, res)
		}
	}
}

func TestSSHRequestsRespectTimeoutAndCancellation(t *testing.T) {
	for _, mode := range []string{"open", "start"} {
		t.Run(mode, func(t *testing.T) {
			session := unresponsiveSession(t, mode)
			ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
			defer cancel()
			done := make(chan *model.ExecutionResult, 1)
			go func() { done <- session.Run(ctx, []string{"true"}, 50*time.Millisecond) }()
			select {
			case res := <-done:
				if res.Completed {
					t.Fatal("blocked request completed")
				}
			case <-time.After(500 * time.Millisecond):
				t.Fatal("request ignored deadline")
			}

		})
	}
}

func TestHandshakeCancellationClosesTransport(t *testing.T) {
	listener, err := net.Listen("tcp", "127.1.2.3:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	accepted := make(chan net.Conn, 1)
	go func() {
		raw, err := listener.Accept()
		if err == nil {
			accepted <- raw
		}
	}()
	cfg := Config{Address: "127.1.2.3", Port: listener.Addr().(*net.TCPAddr).Port, User: "fictitious", ConnectTimeout: time.Second}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		_, err := dialOnce(ctx, cfg, &xssh.ClientConfig{User: cfg.User, HostKeyCallback: xssh.InsecureIgnoreHostKey()})
		done <- err
	}()
	raw := <-accepted
	defer raw.Close()
	cancel()
	select {
	case err := <-done:
		if err == nil {
			t.Fatal("cancelled handshake succeeded")
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("handshake ignored cancellation")
	}
}

func TestAuthenticationCancellationClosesTransport(t *testing.T) {
	_, key, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	signer, err := xssh.NewSignerFromKey(key)
	if err != nil {
		t.Fatal(err)
	}
	entered, release := make(chan struct{}), make(chan struct{})
	defer close(release)
	config := &xssh.ServerConfig{PasswordCallback: func(_ xssh.ConnMetadata, _ []byte) (*xssh.Permissions, error) {
		close(entered)
		<-release
		return nil, fmt.Errorf("rejected")
	}}
	config.AddHostKey(signer)
	listener, err := net.Listen("tcp", "127.1.2.3:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	go func() {
		raw, err := listener.Accept()
		if err != nil {
			return
		}
		defer raw.Close()
		server, _, _, err := xssh.NewServerConn(raw, config)
		if err == nil {
			server.Close()
		}
	}()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	cfg := Config{Address: "127.1.2.3", Port: listener.Addr().(*net.TCPAddr).Port, User: "fake", ConnectTimeout: time.Second}
	done := make(chan error, 1)
	go func() {
		_, err := dialOnce(ctx, cfg, &xssh.ClientConfig{User: "fake", Auth: []xssh.AuthMethod{xssh.Password("fake")}, HostKeyCallback: xssh.InsecureIgnoreHostKey()})
		done <- err
	}()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("authentication did not start")
	}
	cancel()
	select {
	case err := <-done:
		if err == nil {
			t.Fatal("cancelled authentication succeeded")
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("authentication ignored cancellation")
	}
}
