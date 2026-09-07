import { supabase } from "./supabaseClient";

// Runs only after authentication, including after email confirmation.
export async function completeClientSignup(userId) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (user?.id !== userId || user.user_metadata?.signup_type !== "client") return;
  const metadata = user.user_metadata;
  const { data: existing, error: profileError } = await supabase.from("profiles").select("role").eq("user_id", userId).maybeSingle();
  if (profileError) throw profileError;
  if (existing && existing.role !== "client") return;
  if (!existing) {
    const { error: insertError } = await supabase.from("profiles").insert({ user_id: userId, role: "client", first_name: metadata.first_name, last_name: metadata.last_name, email: user.email });
    if (insertError && insertError.code !== "23505") throw insertError;
  }
  const { data: client, error: clientError } = await supabase.from("clients").select("client_id").eq("user_id", userId).maybeSingle();
  if (clientError) throw clientError;
  if (!client) {
    const { data: photographer, error: photographerError } = await supabase.from("photographer_profiles").select("photographer_id").eq("photographer_id", metadata.photographer_id).eq("published", true).single();
    if (photographerError) throw photographerError;
    const { error: insertError } = await supabase.from("clients").insert({ user_id: userId, photographer_id: photographer.photographer_id });
    if (insertError && insertError.code !== "23505") throw insertError;
  }
}
