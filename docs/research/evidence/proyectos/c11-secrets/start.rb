group "secretos" do
  target "comando que lleva la password en argv", weight: 1
  run "echo mysql -u root -p#{'TEUTON_SECRET_INLINE_12345'}"
  expect "mysql"

  target "salida remota que contiene un secreto", weight: 1
  run "echo 'leaked=TEUTON_SECRET_STDOUT_12345'"
  expect "leaked"
end
play do
  show
  export format: "json"
  export format: "txt"
  export format: "yaml"
  export format: "html"
  export format: "xml"
end
