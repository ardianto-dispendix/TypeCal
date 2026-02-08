export interface NotionTask {
  id: string;
  title: string;
  due?: string;
  status?: string;
  project?: string;
}

export interface NotionConfig {
  notionApiKey?: string;
  notionTasksDbId?: string;
}
