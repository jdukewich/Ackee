# Generate lambda zip file
cd ../src
zip -r9 ../aws-deployment/payload.zip .
cd ..
zip -r9 aws-deployment/payload.zip functions api dist node_modules -x "aws-sdk"
cd aws-deployment
terraform apply -var-file="var.tfvars" -auto-approve
