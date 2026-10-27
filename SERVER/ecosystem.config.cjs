module.exports = {
    apps: [
        {
            name: 'songs-server',
            script: 'dist/server.js',
            cwd: '/opt/songs/server',
            instances: 1,
            autorestart: true,
            max_memory_restart: '600M',
            time: true,
            env_production: {
                NODE_ENV: 'production',
            },
        },
    ],
};
