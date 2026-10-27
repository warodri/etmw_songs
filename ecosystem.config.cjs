module.exports = {
    apps: [
        {
            name: 'songs-api',
            script: '.venv/bin/uvicorn',
            args: 'api:app --host 127.0.0.1 --port 8000',
            cwd: '/Volumes/MACMINI-HD/ETMW/etmw_songs',
            interpreter: 'none',
            instances: 1,
            autorestart: true,
            time: true,
            env: {
                HEARTMULA_API_KEY: process.env.HEARTMULA_API_KEY || '',
                HF_HUB_OFFLINE: '1',
                PYTORCH_ENABLE_MPS_FALLBACK: '1',
                TOKENIZERS_PARALLELISM: 'false',
            },
        },
    ],
};
