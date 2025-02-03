#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { TodoTaskAppStack } from "../lib/todoTaskApp-stack";
import { TodoListApiStack } from "../lib/todoListApi-stack";
import { TodoListLayersStack } from "../lib/todoListLayers-stack";
import { TodoListEventStack } from "../lib/todoListEvent-stack";
import { TodoListEventLayerStack } from "../lib/todoListEventLayer-stack";

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const tags = {
  cost: "Treinamento - AWS",
  team: "DEVs T2M",
};

const todoListEventLayerStack = new TodoListEventLayerStack(app, "TodoListEventLayerStack", {
  env: env,
  tags: tags,
});

const todoListLayersStack = new TodoListLayersStack(app, "TodoListLayersStack", {
  env: env,
  tags: tags,
});

const todoListEventStack = new TodoListEventStack(app, "TodoListEventStack", {
  env: env,
  tags: tags,
});
todoListEventStack.addDependency(todoListEventLayerStack);

const todoTaskAppStack = new TodoTaskAppStack(app, "TodoTaskAppStack", {
  env: env,
  tags: tags,
  snsTopic: todoListEventStack.eventTopicSns,
});
todoTaskAppStack.addDependency(todoListLayersStack);

const todoListApiStack = new TodoListApiStack(app, "TodoListApiStack", {
  lambdaTodoTaskApp: todoTaskAppStack.taskHandler,
  env: env,
  tags: tags,
});
todoListApiStack.addDependency(todoTaskAppStack);
