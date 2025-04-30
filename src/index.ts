#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { startJobs } from "./jobs/JobsService";

startJobs();