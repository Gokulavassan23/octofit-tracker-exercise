import { Activity, Team, User, Workout } from '../models/index.js';
import mongoose from 'mongoose';

interface CreateActivityInput {
  userId: string;
  teamId: string;
  type: string;
  minutes: number;
}

interface CreateTeamInput {
  name?: string;
  mascot: string;
  members?: string[];
}

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown): Promise<any> {
  const data = input as Partial<CreateActivityInput>;

  // Validate required fields
  if (!data.userId || !data.teamId || !data.type || data.minutes === undefined) {
    const error = new Error('Missing required fields: userId, teamId, type, minutes');
    (error as any).status = 400;
    throw error;
  }

  // Validate ObjectId format
  if (!isValidObjectId(data.userId) || !isValidObjectId(data.teamId)) {
    const error = new Error('Invalid userId or teamId format');
    (error as any).status = 400;
    throw error;
  }

  // Verify user and team exist
  const [userExists, teamExists] = await Promise.all([
    User.exists({ _id: data.userId }),
    Team.exists({ _id: data.teamId }),
  ]);

  if (!userExists) {
    const error = new Error('User not found');
    (error as any).status = 400;
    throw error;
  }

  if (!teamExists) {
    const error = new Error('Team not found');
    (error as any).status = 400;
    throw error;
  }

  // Calculate points (1:1 ratio with minutes)
  const points = data.minutes;
  const occurredAt = new Date();

  // Create and return activity
  const activity = await Activity.create({
    user: data.userId,
    team: data.teamId,
    type: data.type,
    minutes: data.minutes,
    points,
    occurredAt,
  });

  return activity.toObject();
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown): Promise<any> {
  const data = input as Partial<CreateTeamInput>;

  // Validate required field: name
  if (!data.name) {
    const error = new Error('Team name is required');
    (error as any).status = 400;
    throw error;
  }

  // Create team with optional members
  const team = await Team.create({
    name: data.name,
    mascot: data.mascot || '',
    members: data.members || [],
  });

  return team.toObject();
}

export async function getLeaderboard(): Promise<any> {
  const leaderboard = await Activity.aggregate([
    {
      $group: {
        _id: '$team',
        totalPoints: { $sum: '$points' },
      },
    },
    {
      $lookup: {
        from: 'teams',
        localField: '_id',
        foreignField: '_id',
        as: 'team',
      },
    },
    {
      $unwind: '$team',
    },
    {
      $sort: { totalPoints: -1 },
    },
    {
      $project: {
        teamName: '$team.name',
        totalPoints: 1,
        _id: 0,
      },
    },
  ]);

  // Add rank field
  return leaderboard.map((entry: any, index: number) => ({
    ...entry,
    rank: index + 1,
  }));
}

export async function suggestWorkouts(userEmail: string): Promise<any> {
  // Decode email (handle URL encoding)
  const decodedEmail = decodeURIComponent(userEmail);

  // Find user by email
  const user = await User.findOne({ email: decodedEmail });
  if (!user) {
    const error = new Error('User not found');
    (error as any).status = 404;
    throw error;
  }

  // Get recent activities for this user
  const recentActivities = await Activity.find({ user: user._id }).sort({ occurredAt: -1 }).limit(5).lean();

  // Try to match workouts by fitness goal first
  let suggestions = await Workout.find({ focus: user.fitnessGoal }).lean();

  // If no goal match, try to match by recent activity types
  if (suggestions.length === 0 && recentActivities.length > 0) {
    const activityTypes = [...new Set(recentActivities.map((a: any) => a.type))];
    const focusMap: Record<string, string> = {
      run: 'endurance',
      cycle: 'endurance',
      strength: 'strength',
      walk: 'endurance',
    };

    const focuses = activityTypes
      .map((type: string) => focusMap[type])
      .filter(Boolean);

    if (focuses.length > 0) {
      suggestions = await Workout.find({ focus: { $in: focuses } }).lean();
    }
  }

  // Add reason field explaining why each workout was suggested
  return suggestions.map((workout: any) => ({
    ...workout,
    _id: workout._id.toString(),
    reason: `You've been ${recentActivities.length > 0 ? recentActivities[0].type : 'active'}—build ${workout.focus}`,
  }));
}

export { User };
