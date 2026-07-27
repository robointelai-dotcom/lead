import { processSearchJob } from "./src/lib/workers/searchWorker";

async function run() {
  await processSearchJob({
    data: {
      searchJobId: "dummy",
      organizationId: "123e4567-e89b-12d3-a456-426614174000",
      niche: "Plumber",
      city: "Los Angeles",
      maxResults: 5,
      autoFindEmails: true,
      autoDispatchToGithub: false,
      autoGenerateReport: false
    },
    updateProgress: async () => {}
  });
}
run();
