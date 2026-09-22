(() => {
  const params = new URLSearchParams(location.hash.slice(1));
  if (['invite', 'recovery'].includes(params.get('type')) && (params.has('access_token') || params.has('error'))) {
    location.replace('admin-password.html' + location.hash);
  }
})();
