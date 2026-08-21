import { installSendJobsController } from "./send-jobs.js";

const stylesheet = "/app-shell.css";
if (!document.querySelector(`link[href="${stylesheet}"]`)) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = stylesheet;
  document.head.appendChild(link);
}

installSendJobsController();
