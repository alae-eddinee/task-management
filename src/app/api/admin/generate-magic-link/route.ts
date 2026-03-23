import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Find user by email to verify they exist and check role
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify the user is a manager or admin
    if (userData.role !== 'manager' && userData.role !== 'admin') {
      return NextResponse.json(
        { error: 'Magic links can only be generated for managers and admins' },
        { status: 403 }
      );
    }

    // Use Supabase's built-in generateLink API to create a magic link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/manager`,
      },
    });

    if (linkError || !linkData) {
      console.error('Failed to generate magic link:', linkError);
      return NextResponse.json(
        { error: 'Failed to generate magic link' },
        { status: 500 }
      );
    }

    // The generated link contains a hash that Supabase will verify
    // We return the properties needed to construct the final URL
    const { hashed_token } = linkData.properties;
    
    // Construct the magic link URL that goes to our API first
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const magicLink = `${baseUrl}/auth/confirm?token=${hashed_token}&type=magiclink&next=/manager`;

    return NextResponse.json({ magicLink });
  } catch (error) {
    console.error('Error generating magic link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
