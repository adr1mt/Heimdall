group "g" do
 target "t"
 run "true"
 expect_exit 0
end
play do
 show
end
