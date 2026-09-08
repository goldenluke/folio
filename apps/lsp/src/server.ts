#!/usr/bin/env node
import { createLspServer } from './create-server.js';

createLspServer(process.stdin, process.stdout);
