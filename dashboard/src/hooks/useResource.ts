import {useCallback,useEffect,useState} from 'react';
import {api} from '../services/api';
export function useResource<T>(path:string,interval=0){
 const [data,setData]=useState<T|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{try{setData(await api<T>(path));setError('');}catch(e){setError(e instanceof Error?e.message:'Gagal memuat.');}finally{setLoading(false);}},[path]);
 useEffect(()=>{void refresh();if(interval){const timer=setInterval(()=>void refresh(),interval);return()=>clearInterval(timer);}},[refresh,interval]);
 return {data,error,loading,refresh,setData};
}

