#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { TodoTaskAppStack } from "../lib/todoTaskApp-stack";
import { TodoListApiStack } from "../lib/todoListApi-stack";

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const tags = {
  cost: "Treinamento - AWS",
  team: "DEVs T2M",
};

const todoTaskAppStack = new TodoTaskAppStack(app, "TodoTaskAppStack", {
  env: env,
  tags: tags,
});

const todoListApiStack = new TodoListApiStack(app, "TodoListApiStack", {
  lambdaTodoTaskApp: todoTaskAppStack.taskHandler,
  env: env,
  tags: tags,
});

todoListApiStack.addDependency(todoTaskAppStack);
