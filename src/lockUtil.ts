const lockIssued:{[key: string]: boolean} = {};

export async function acquireLock(lockIdentity:string){
  while(lockIssued[lockIdentity] === true){
    console.log(`${lockIdentity} is currently locked, caller waiting for it to be released...`);
    await new Promise(resolve => setTimeout(()=> resolve(), 1000));
  }
  lockIssued[lockIdentity] = true;
}

export function releaseLock(lockIdentity:string){
  delete lockIssued[lockIdentity];
}
