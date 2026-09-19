group "ssh basico" do
  target "login correcto y whoami", weight: 1
  run "whoami", on: :host1
  expect "alumno"

  target "exit code remoto 0", weight: 1
  run "true", on: :host1
  expect_exit 0

  target "exit code remoto 3", weight: 1
  run "sh -c 'exit 3'", on: :host1
  expect_exit 3

  target "stderr remoto", weight: 1
  run "sh -c 'echo REMOTE_STDERR >&2'", on: :host1
  expect "REMOTE_STDERR"
end
play do
  show
  export format: "json"
end
