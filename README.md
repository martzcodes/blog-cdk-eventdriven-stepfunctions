# Event-Driven Step Functions (blog post code)

To run this project:
1. `npm install`
2. `npx cdk deploy` (have your AWS profile ready to go)
3. `aws events put-events --entries Source=project,DetailType=start,EventBusName=default,Detail=\"{}\" --region us-east-1` (this event will start the step function)
4. `npx cdk-app-cli Bucket visit-console` (this will take you quickly to the s3 bucket where files will eventually got populated)