//function to check if the envionment variable contains any particular env content 
//for example : required("DATABSASE_URL"); 
//Checks mandatory environment variables and throws an error if one is missing.
function required(name){
    const value = process.env[name];

    if(!value){
        throw new Error(`Missing environment variable ${name}. Copy .env.example to .env and fill it in`);
    }

    return value;
}


//Reads and organises environment, port, database URL and timezone.
export const config = {
    env: process.env.NODE_ENV ?? 'developement',
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: required('DATABASE_URL'),
    timezone:process.env.APP_TIMEZONE ?? 'Asia/Kolkata'
}

// Checks whether the application is running in production.
export const isProduction = config.env === 'production';