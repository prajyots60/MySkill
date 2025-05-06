import { PrismaClient } from '@prisma/client'

// Extend PrismaClient interface
declare module '@prisma/client' {
  interface PrismaClient {
    exam: {
      findUnique: any;
      findFirst: any;
      findMany: any;
      create: any;
      createMany: any;
      delete: any;
      update: any;
      deleteMany: any;
      updateMany: any;
      upsert: any;
      count: any;
      aggregate: any;
      groupBy: any;
    };
    question: {
      findUnique: any;
      findFirst: any;
      findMany: any;
      create: any;
      createMany: any;
      delete: any;
      update: any;
      deleteMany: any;
      updateMany: any;
      upsert: any;
      count: any;
      aggregate: any;
      groupBy: any;
    };
    questionOption: {
      findUnique: any;
      findFirst: any;
      findMany: any;
      create: any;
      createMany: any;
      delete: any;
      update: any;
      deleteMany: any;
      updateMany: any;
      upsert: any;
      count: any;
      aggregate: any;
      groupBy: any;
    };
    studentExamResponse: {
      findUnique: any;
      findFirst: any;
      findMany: any;
      create: any;
      createMany: any;
      delete: any;
      update: any;
      deleteMany: any;
      updateMany: any;
      upsert: any;
      count: any;
      aggregate: any;
      groupBy: any;
    };
    questionResponse: {
      findUnique: any;
      findFirst: any;
      findMany: any;
      create: any;
      createMany: any;
      delete: any;
      update: any;
      deleteMany: any;
      updateMany: any;
      upsert: any;
      count: any;
      aggregate: any;
      groupBy: any;
    };
  }
}

export {}