group "ssh real" do
  target "whoami remoto", weight: 1
  run "whoami", on: :host1
  expect "alumno"

  target "exit 0 remoto", weight: 1
  run "true", on: :host1
  expect_exit 0

  target "exit 3 remoto", weight: 1
  run "sh -c 'exit 3'", on: :host1
  expect_exit 3

  target "stderr remoto se mezcla?", weight: 1
  run "sh -c 'echo SOLO_STDERR >&2; echo SOLO_STDOUT'", on: :host1
  expect "SOLO_STDERR"

  target "comando inexistente remoto", weight: 1
  run "no_existe_remoto_999", on: :host1
  expect_exit 127
end
play do
  show
  export format: "json"
end
