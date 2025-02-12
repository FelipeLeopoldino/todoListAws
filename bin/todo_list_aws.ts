#!/usr/bin/env node
// Este arquivo é a entrada da aplicação CDK para a criação de múltiplas stacks AWS.
// Ele configura e organiza as dependências entre as stacks utilizadas para a aplicação Todo List.

import * as cdk from "aws-cdk-lib";
import { TodoTaskAppStack } from "../lib/todoTaskApp-stack";
import { TodoListApiStack } from "../lib/todoListApi-stack";
import { TodoListLayersStack } from "../lib/todoListLayers-stack";
import { TodoListEventStack } from "../lib/todoListEvent-stack";
import { TodoListEventLayerStack } from "../lib/todoListEventLayer-stack";
import { TodoNotifyStack } from "../lib/todoNotify-stack";
import { AuthLayerStack } from "../lib/authLayer-stack";

// Cria uma instância da aplicação CDK
const app = new cdk.App();

// Define o ambiente (conta AWS e região) usando as variáveis de ambiente padrão do CDK
const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// Define tags comuns a todas as stacks para facilitar a identificação e gerenciamento de custos e equipes.
const tags = {
  cost: "Treinamento - AWS",
  team: "DEVs T2M",
};

// Cria a stack de autenticação (camada de autorização/auth)
const authLayerStack = new AuthLayerStack(app, "AuthLayerStack", {
  env: env,
  tags: tags,
});

// Cria a stack que contém a camada de eventos para a Todo List
const todoListEventLayerStack = new TodoListEventLayerStack(app, "TodoListEventLayerStack", {
  env: env,
  tags: tags,
});

// Cria a stack que centraliza as layers (bibliotecas compartilhadas) da aplicação
const todoListLayersStack = new TodoListLayersStack(app, "TodoListLayersStack", {
  env: env,
  tags: tags,
});

// Cria a stack responsável pelos eventos da Todo List
const todoListEventStack = new TodoListEventStack(app, "TodoListEventStack", {
  env: env,
  tags: tags,
});
// Define dependência da stack de eventos com a stack de camada de eventos
todoListEventStack.addDependency(todoListEventLayerStack);

// Cria a stack que realiza notificações (e.g., utilizando SNS) na aplicação
const todoListNotifyStack = new TodoNotifyStack(app, "TodoNotifyStack", {
  env: env,
  tags: tags,
  snsTopic: todoListEventStack.eventTopicSns, // utiliza o tópico SNS definido na stack de eventos
});
// Define que a stack de notificações depende das stacks de eventos e das layers
todoListNotifyStack.addDependency(todoListEventStack);
todoListNotifyStack.addDependency(todoListLayersStack);

// Cria a stack que gerencia a aplicação de tarefas (todo tasks)
const todoTaskAppStack = new TodoTaskAppStack(app, "TodoTaskAppStack", {
  env: env,
  tags: tags,
  snsTopic: todoListEventStack.eventTopicSns, // utiliza o tópico SNS para eventos
});
// Define dependências da stack de tarefas com as stacks de layers, eventos e autenticação
todoTaskAppStack.addDependency(todoListLayersStack);
todoTaskAppStack.addDependency(todoListEventStack);
todoTaskAppStack.addDependency(authLayerStack);

// Cria a stack que fornece a API da Todo List
const todoListApiStack = new TodoListApiStack(app, "TodoListApiStack", {
  // As funções Lambda utilizadas na API são definidas na stack de tarefas
  lambdaTodoTaskApp: todoTaskAppStack.taskHandler,
  s3UploadUrlFunction: todoTaskAppStack.s3UploadUrlFunction,
  env: env,
  tags: tags,
});
// Define a dependência da stack da API em relação à stack de tarefas
todoListApiStack.addDependency(todoTaskAppStack);
