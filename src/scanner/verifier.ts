import { MatchesRepository, MatchRecord } from '../db/matches-repo';
import { RepositoriesRepository } from '../db/repos-repo';

export class Verifier {
  private matchesRepo: MatchesRepository;
  private reposRepo: RepositoriesRepository;

  constructor() {
    this.matchesRepo = new MatchesRepository();
    this.reposRepo = new RepositoriesRepository();
  }

  async verifyMatch(matchId: number): Promise<MatchRecord | null> {
    // This could include additional verification logic
    // For now, we'll just mark high-confidence matches as verified
    const match = await this.matchesRepo.findHighConfidenceMatches(1000);
    const foundMatch = match.find(m => m.id === matchId);

    if (foundMatch && foundMatch.confidenceScore >= 70) {
      await this.matchesRepo.updateStatus(matchId, 'verified');
      return foundMatch;
    }

    return null;
  }

  async getMatchDetails(matchId: number): Promise<{
    match: MatchRecord;
    repo1: any;
    repo2: any;
  } | null> {
    const matches = await this.matchesRepo.findHighConfidenceMatches(10000);
    const match = matches.find(m => m.id === matchId);

    if (!match) {
      return null;
    }

    const repo1 = await this.reposRepo.findById(match.repo1Id);
    const repo2 = await this.reposRepo.findById(match.repo2Id);

    if (!repo1 || !repo2) {
      return null;
    }

    return {
      match,
      repo1,
      repo2,
    };
  }
}

