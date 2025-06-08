const jobs = require("../data/jobs");

// Basic keyword-based match (you can enhance it later)
function matchJob(resumeText) {
  const lowerText = resumeText.toLowerCase();

  const jobScores = jobs.map((job) => {
    const matchedSkills = job.skills.filter(skill =>
      lowerText.includes(skill)
    );

    return {
      ...job,
      matchCount: matchedSkills.length,
      matchedSkills
    };
  });

  // Sort by matchCount descending
  jobScores.sort((a, b) => b.matchCount - a.matchCount);

  // Return top match or null
  return jobScores[0].matchCount > 0 ? jobScores[0] : null;
}

module.exports = matchJob;
