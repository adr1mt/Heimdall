group "g" do
 target "t"
 run "true"
 expect_exit 0
 raise "BOOM_INTERNO"
end
play do
 show
end
