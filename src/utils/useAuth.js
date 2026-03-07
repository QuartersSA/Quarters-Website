// This app uses custom sessionStorage-based authentication
// No @auth/create/react imports needed

function useAuth() {
  // This hook is not used in the current app
  // The app uses sessionStorage-based auth for employees/admins
  return {
    signInWithCredentials: () => {},
    signUpWithCredentials: () => {},
    signInWithGoogle: () => {},
    signInWithFacebook: () => {},
    signInWithTwitter: () => {},
    signInWithApple: () => {},
    signOut: () => {},
  };
}

export default useAuth;
