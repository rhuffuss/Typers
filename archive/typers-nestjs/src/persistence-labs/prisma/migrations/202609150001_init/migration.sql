CREATE TABLE "prisma_writers" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "prisma_writers_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "prisma_notes" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "writerId" INTEGER NOT NULL,
  CONSTRAINT "prisma_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "prisma_notes_writerId_fkey" FOREIGN KEY ("writerId") REFERENCES "prisma_writers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
