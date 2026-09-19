group "g" do
 target "sin password en el config", weight: 1
 run "whoami", on: :host1
 expect "alumno"
end
play do
 show
 export format: "json"
end
