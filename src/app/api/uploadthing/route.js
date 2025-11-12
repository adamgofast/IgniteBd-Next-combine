import { createRouteHandler } from "uploadthing/next";
import { createUploadthing } from "uploadthing/next";
import { prisma } from "@/lib/prisma";

const f = createUploadthing();

export const ourFileRouter = {
  clientUpload: f({
    "text/csv": { maxFileSize: "8MB" },
    "application/pdf": { maxFileSize: "8MB" },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { maxFileSize: "8MB" },
    "image/*": { maxFileSize: "8MB" },
  })
    .onUploadComplete(async ({ file, metadata }) => {
      // Get ownerId from metadata if available, otherwise use "joel" as default
      const ownerId = metadata?.ownerId || "joel";
      
      await prisma.clientUpload.create({
        data: {
          ownerId: ownerId,
          fileUrl: file.url,
          originalName: file.name,
          fileType: file.type,
          size: file.size,
        },
      });
    }),
};

export const { GET, POST } = createRouteHandler({ router: ourFileRouter });

