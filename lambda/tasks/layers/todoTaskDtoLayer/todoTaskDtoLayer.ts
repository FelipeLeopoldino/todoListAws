export interface TodoTaskPostRequest {
  title: string;
  description: string;
  deadline: Date;
  owner: {
    name: string;
    email: string;
  };
  assignedBy: {
    name: string;
    email: string;
  };
}

export interface TodoTaskPutRequest {
  newStatus: "ABANDONED" | "PENDING" | "COMPLETED";
}
