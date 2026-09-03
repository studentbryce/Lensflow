import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

function PublicPhotographer() {
  const [photographer, setPhotographer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchPhotographer() {
      const { data, error } = await supabase
        .from('photographer_profiles')
        .select('*')
        .eq('slug', 'rls-test-photographer-a')
        .eq('published', true)
        .single();

      if (error) {
        console.error('Photographer fetch error:', error);
        setError(error.message);
      } else {
        console.log('Photographer:', data);
        setPhotographer(data);
      }

      setLoading(false);
    }

    fetchPhotographer();
  }, []);

  if (loading) {
    return <p>Loading photographer...</p>;
  }

  if (error) {
    return <p>Error: {error}</p>;
  }

  if (!photographer) {
    return <p>Photographer not found.</p>;
  }

  return (
    <div>
      <h1>{photographer.business_name}</h1>

      <p>
        Slug: /{photographer.slug}
      </p>

      <p>
        {photographer.description}
      </p>

      <p>
        Email: {photographer.email}
      </p>
    </div>
  );
}

export default PublicPhotographer;