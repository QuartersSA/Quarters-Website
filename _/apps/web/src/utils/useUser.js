// This app uses custom localStorage-based authentication
// No @auth/create/react imports needed

const useUser = () => {
  // This hook is not used in the current app
  // The app uses localStorage-based auth for employees/admins
  return {
    user: null,
    data: null,
    loading: false,
    refetch: () => {},
  };
};

export { useUser };

export default useUser;
