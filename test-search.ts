import { processSearchJob } from "./src/lib/workers/searchWorker";

const payload = {
  searchJobId: "b1cbe97f-abcd-efgh-ijkl-1234567890ab",
  organizationId: "123e4567-e89b-12d3-a456-426614174000",
  campaignId: null,
  niche: "Dentist",
  country: "United States",
  state: "NY",
  city: "New York",
  postalCode: null,
  maxResults: 20,
  minRating: null,
  minReviewCount: null,
  hasEmail: false,
  hasPhone: false,
  hasWebsite: false,
  autoFindEmails: true,
  autoDispatchToGithub: false,
  autoGenerateReport: false
};

processSearchJob({ data: payload as any, updateProgress: async () => {} })
  .then(res => console.log("Success:", res))
  .catch(err => console.error("Error:", err));
