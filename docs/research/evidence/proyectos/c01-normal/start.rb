group "normal" do
  target "exit 0 + stdout", weight: 1
  run "echo HELLO_STDOUT"
  expect "HELLO_STDOUT"

  target "exit code 0", weight: 1
  run "true"
  expect_exit 0

  target "exit code 3", weight: 1
  run "sh -c 'exit 3'"
  expect_exit 3

  target "stderr only, exit 0", weight: 1
  run "sh -c 'echo ONLY_STDERR >&2'"
  expect "ONLY_STDERR"

  target "stderr captured but exit nonzero", weight: 1
  run "sh -c 'echo BOOM >&2; exit 7'"
  expect_exit 7

  target "empty output", weight: 1
  run "true"
  expect_nothing

  target "weighted heavy", weight: 10
  run "echo WEIGHTED"
  expect "WEIGHTED"

  target "weighted heavy fail", weight: 10
  run "echo WEIGHTED"
  expect "NOPE_NOT_HERE"
end

play do
  show
  export format: "json"
  export format: "txt"
  export format: "yaml"
  export format: "html"
  export format: "xml"
  export format: "markdown"
end
