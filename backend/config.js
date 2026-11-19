function required(name){
    const value = process.env[name];

    if(!value){
        throw new Error(`Missing environment variable ${name}. Copy .env.example to .env and fill it in`);
    }

    return value;
}
export const config = {
    env: process.env.NODE_ENV ?? 'developement',
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: required('DATABASE_URL'),
    timezone:process.env.APP_TIMEZONE ?? 'Asia/Kolkata'
}

export const isProduction = config.env === 'production';