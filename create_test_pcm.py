#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
创建测试PCM文件的脚本
生成一个简单的正弦波PCM文件用于测试播放器
"""

import os
import struct
import math

def create_test_pcm(filename, duration=3, sample_rate=16000, frequency=440):
    """
    创建一个测试PCM文件
    - filename: 输出文件名
    - duration: 持续时间（秒）
    - sample_rate: 采样率（Hz）
    - frequency: 频率（Hz）
    """
    # 计算样本数
    num_samples = int(sample_rate * duration)
    
    # 创建data目录
    data_dir = 'data'
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
    
    filepath = os.path.join(data_dir, filename)
    
    # 生成正弦波PCM数据
    with open(filepath, 'wb') as f:
        for i in range(num_samples):
            # 生成正弦波
            t = i / sample_rate
            amplitude = 0.5  # 振幅
            sample = amplitude * math.sin(2 * math.pi * frequency * t)
            
            # 转换为16位整数（小端序）
            sample_int = int(sample * 32767)
            f.write(struct.pack('<h', sample_int))  # '<h' 表示16位小端序有符号整数
    
    print(f"已创建测试PCM文件: {filepath}")
    print(f"参数: {duration}秒, {sample_rate}Hz, {frequency}Hz正弦波")

def main():
    """主函数"""
    print("创建测试PCM文件...")
    
    # 创建几个不同频率的测试文件
    test_files = [
        ("test_440hz.pcm", 3, 16000, 440),    # A4音符
        ("test_880hz.pcm", 3, 16000, 880),    # A5音符
        ("test_220hz.pcm", 3, 16000, 220),    # A3音符
    ]
    
    for filename, duration, sample_rate, frequency in test_files:
        create_test_pcm(filename, duration, sample_rate, frequency)
    
    print("\n测试文件创建完成！")
    print("现在可以运行播放器来测试这些文件。")

if __name__ == '__main__':
    main()
