'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SmartImage } from '@/components/common/smart-image';
import { ShoppingCart, ExternalLink } from 'lucide-react';
import { emoticonApi } from '@/lib/api/emoticon';
import { useRouter } from 'next/navigation';

interface EmoticonDetailsModalProps {
  url: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EmoticonDetailsModal({ url, isOpen, onClose }: EmoticonDetailsModalProps) {
  const [packInfo, setPackInfo] = useState<{ packId: string; pack: any } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const fetchPackInfo = async () => {
    if (!url) return;
    setIsLoading(true);
    try {
      const info = await emoticonApi.getPackByUrl(url);
      setPackInfo(info);
    } catch (error) {
      console.error('Failed to fetch pack info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        onOpenAutoFocus={(e) => {
            e.preventDefault();
            fetchPackInfo();
        }}
        className="sm:max-w-[400px] p-6"
      >
        <DialogHeader>
          <DialogTitle className="text-center">이모티콘 정보</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center space-y-6 py-4">
          <div className="relative group/zoom bg-muted/20 rounded-2xl p-4 border border-border/50">
            <SmartImage
              src={url || ''}
              alt="emoticon large"
              className="w-40 h-40 object-contain transition-transform duration-300 group-hover/zoom:scale-110"
              fallbackClassName="w-40 h-40"
              showErrorText={false}
            />
          </div>

          <div className="w-full space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : packInfo ? (
              <div className="space-y-4 text-center">
                <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">소속 팩</p>
                    <p className="text-lg font-bold">{packInfo.pack.title}</p>
                </div>
                
                <Button 
                  className="w-full gap-2 font-bold"
                  onClick={() => {
                    onClose();
                    router.push(`/emoticons/${packInfo.pack.id}`);
                  }}
                >
                  {packInfo.pack.price > 0 ? (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      상점으로 이동하기
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      상세 페이지 보기
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground">이모티콘 정보를 불러오지 못했습니다.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
