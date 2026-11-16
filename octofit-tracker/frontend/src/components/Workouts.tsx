import { useEffect, useState } from 'react';
import { getJson } from '../api/client.js';

interface Workout {
  _id?: string;
  title: string;
  focus: string;
  minutes: number;
  difficulty: string;
  reason?: string;
}

interface GetSuggestionsResponse {
  suggestions: Workout[];
}

export default function Workouts() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Workout[]>([]);

  useEffect(() => {
    let mounted = true;
    const userEmail = 'mona@example.com';
    getJson<GetSuggestionsResponse>(`/api/workouts/suggestions/${encodeURIComponent(userEmail)}`)
      .then((data) => {
        if (mounted) {
          setSuggestions(data.suggestions);
          setError(null);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load suggestions');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="card h-100">
        <div className="card-body">
          <h2 className="h4">Workout Suggestions</h2>
          <p role="status">Loading suggestions...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card h-100">
        <div className="card-body">
          <h2 className="h4">Workout Suggestions</h2>
          <p role="alert">Unable to load suggestions: {error}</p>
        </div>
      </section>
    );
  }

  if (suggestions.length === 0) {
    return (
      <section className="card h-100">
        <div className="card-body">
          <h2 className="h4">Workout Suggestions</h2>
          <p>No workout suggestions available.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card h-100">
      <div className="card-body">
        <h2 className="h4">Workout Suggestions</h2>
        <div className="table-responsive">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Title</th>
                <th>Focus</th>
                <th>Minutes</th>
                <th>Difficulty</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((workout, index) => (
                <tr key={workout._id ?? index}>
                  <td>{workout.title}</td>
                  <td>{workout.focus}</td>
                  <td>{workout.minutes}</td>
                  <td>{workout.difficulty}</td>
                  <td>{workout.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
